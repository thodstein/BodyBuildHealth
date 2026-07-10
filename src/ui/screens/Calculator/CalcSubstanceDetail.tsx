// ════════════════════════════════════════════════════════════════════════════
//  CalcSubstanceDetail — раскрываемая карточка препарата со всеми деталями
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import type { SupportRecommendation } from '../../../engines/tz-mapper-engine';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-catalog-data';
import { DEFAULT_DOSAGES } from '../../../data/support-meta';
import { getSubstanceForm } from '../../../data/substance-forms';
import { getTitrationProtocol } from '../../../data/titration-protocols';
import type { RecommendedSub } from '../../../engines/tz-mapper-engine';
import { GLASS } from './Calc.types';

interface Props {
  sub: RecommendedSub;
  rec: SupportRecommendation;
  subNameRu: (id: string) => string;
  subDosage: (id: string) => { mg: number; timing: string } | null;
  subTier: (id: string) => string;
  titrationFactors?: Map<string, number>;
  canonIdLocal: (id: string) => string;
}

export const CalcSubstanceDetail: React.FC<Props> = ({
  sub, subNameRu, subDosage, subTier, titrationFactors, canonIdLocal,
}) => {
  const id = sub.substanceId;
  const name = subNameRu(id);
  const dose = subDosage(id);
  const titrFactor = titrationFactors?.get(canonIdLocal(id));
  const isTitrated = !!titrFactor && titrFactor > 1;
  const form = getSubstanceForm(id);
  const titr = getTitrationProtocol(id);
  const catalogEntry = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toLowerCase()] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
  const tier = subTier(id);

  const doseMg = dose ? (titrFactor && titrFactor > 1 ? Math.round(dose.mg * titrFactor) : dose.mg) : null;

  return (
    <div style={{ ...GLASS, padding: '10px 12px', marginBottom: 3, fontSize: 8, lineHeight: 1.5, borderLeft: '2px solid rgba(99,102,241,0.3)' }}>

      {/* Заголовок: название + дозировка */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text)' }}>{name}</span>
        {doseMg !== null && (
          <span style={{ fontSize: 10, fontWeight: 700, color: isTitrated ? '#f59e0b' : '#00e68a', whiteSpace: 'nowrap' }}>
            {doseMg} мг
          </span>
        )}
        {dose && (
          <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>· {dose.timing}</span>
        )}
        {isTitrated && (
          <span style={{ fontSize: 7, fontWeight: 700, color: '#f59e0b', padding: '1px 5px', borderRadius: 4, background: 'rgba(245,158,11,0.15)' }}>
            ↑{((titrFactor! - 1) * 100).toFixed(0)}%
          </span>
        )}
        <span style={{ fontSize: 7, padding: '1px 6px', borderRadius: 6, fontWeight: 600, background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>
          {tier === 'core' ? 'CORE' : tier === 'standard' ? 'STD' : tier === 'advanced' ? 'ADV' : 'SPEC'}
        </span>
        <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>док.уровень: {sub.q}</span>
      </div>

      {/* Почему назначен */}
      <div style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.05)', marginBottom: 5, border: '1px solid rgba(0,230,138,0.1)' }}>
        <span style={{ fontSize: 7, fontWeight: 700, color: '#00e68a', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Почему назначен: </span>
        <span style={{ fontSize: 8, color: 'var(--text-light)' }}>{sub.reason}</span>
      </div>

      {/* Что делает (описание из каталога) */}
      {catalogEntry?.description && (
        <div style={{ marginBottom: 5 }}>
          <span style={{ fontSize: 7, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Действие: </span>
          <span style={{ fontSize: 8, color: 'var(--text-light)', opacity: 0.85 }}>{catalogEntry.description.substring(0, 200)}</span>
        </div>
      )}

      {/* Механизмы покрытия (если есть) */}
      {sub.mechsCovered.length > 0 && (
        <div style={{ marginBottom: 5, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          <span style={{ fontSize: 7, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.3px', width: '100%' }}>ТЗ-механизмы:</span>
          {sub.mechsCovered.map(m => (
            <span key={m} style={{ fontSize: 7, padding: '1px 6px', borderRadius: 6, background: 'rgba(168,85,247,0.08)', color: '#c4b5fd', fontWeight: 500 }}>{m}</span>
          ))}
        </div>
      )}

      {/* Форма и аптечные бренды */}
      {form && (
        <div style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.2)', marginBottom: 5, border: '1px solid rgba(255,255,255,0.04)' }}>
          {form.optimalForm && (
            <div style={{ marginBottom: 2 }}>
              <span style={{ fontWeight: 700, color: '#818cf8', fontSize: 7 }}>Форма: </span>
              <span style={{ color: 'var(--text-light)', fontSize: 8 }}>{form.optimalForm}</span>
            </div>
          )}
          {form.pharmacyBrands && form.pharmacyBrands.length > 0 && (
            <div style={{ marginBottom: 2 }}>
              <span style={{ fontWeight: 700, color: '#00e68a', fontSize: 7 }}>Аптечные: </span>
              <span style={{ color: 'var(--text-light)', fontSize: 8 }}>{form.pharmacyBrands.join(', ')}</span>
            </div>
          )}
          {form.altForm && (
            <div style={{ marginBottom: 2 }}>
              <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: 7 }}>Замена: </span>
              <span style={{ color: 'var(--text-light)', fontSize: 8 }}>{form.altForm}</span>
            </div>
          )}
          {form.bioavailability && (
            <div style={{ marginBottom: 2 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-dim)', fontSize: 7 }}>Биодоступность: </span>
              <span style={{ color: 'var(--text-light)', fontSize: 8 }}>{form.bioavailability}</span>
            </div>
          )}
          {form.note && (
            <div style={{ marginBottom: 2, color: 'var(--text-light)', fontSize: 8, opacity: 0.85 }}>
              <span style={{ fontWeight: 700, fontSize: 7 }}>⚠ </span>{form.note}
            </div>
          )}
          {form.bestTime && (
            <div>
              <span style={{ fontWeight: 600, color: 'var(--text-dim)', fontSize: 7 }}>Приём: </span>
              <span style={{ color: 'var(--text-light)', fontSize: 8 }}>{form.bestTime}</span>
            </div>
          )}
          {form.cycleBreaks && (
            <div>
              <span style={{ fontWeight: 600, color: '#f59e0b', fontSize: 7 }}>Цикл: </span>
              <span style={{ color: 'var(--text-light)', fontSize: 8 }}>{form.cycleBreaks}</span>
            </div>
          )}
        </div>
      )}

      {/* Титрация */}
      {titr && (
        <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)', marginBottom: 5 }}>
          <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 3, fontSize: 7 }}>📈 Титрация: {titr.startDose} → {titr.maxDose}</div>
          {titr.steps.map((step, si) => (
            <div key={si} style={{ fontSize: 7, color: 'var(--text-light)', marginBottom: 2 }}>
              <b style={{ color: '#fbbf24' }}>{step.dose}</b> ({step.duration})
              {step.trigger ? ' — ' + step.trigger : ''}
              {step.labTarget ? ` [цель: ${step.labTarget}]` : ''}
            </div>
          ))}
          {titr.flushWarning && (
            <div style={{ fontSize: 7, color: '#fbbf24', marginTop: 3, fontWeight: 600 }}>⚠ {titr.flushWarning}</div>
          )}
          {titr.monitorLabs && titr.monitorLabs.length > 0 && (
            <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 3 }}>
              🧪 Контроль: {titr.monitorLabs.join(', ')} — {titr.frequency}
            </div>
          )}
          {titr.stopConditions && titr.stopConditions.length > 0 && (
            <div style={{ fontSize: 7, color: '#ef4444', marginTop: 2 }}>
              ⛔ Стоп: {titr.stopConditions.join('; ')}
            </div>
          )}
        </div>
      )}

      {/* Мониторинг из каталога */}
      {catalogEntry?.monitoring && catalogEntry.monitoring.length > 0 && (
        <div style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)', marginBottom: 5 }}>
          <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: 3, fontSize: 7 }}>🧪 Мониторинг анализов:</div>
          {catalogEntry.monitoring.map((m, mi) => {
            const mw = typeof m === 'string' ? m : m.what || '';
            const wn = typeof m === 'string' ? '' : m.when || '';
            const tr = typeof m === 'string' ? '' : m.targetRange || '';
            return (
              <div key={mi} style={{ fontSize: 7, color: 'var(--text-light)', marginBottom: 1 }}>
                • <b>{mw}</b>{wn ? ` (${wn})` : ''}{tr ? ` → ${tr}` : ''}
              </div>
            );
          })}
        </div>
      )}

      {/* Противопоказания из каталога */}
      {catalogEntry?.contraindications && catalogEntry.contraindications.length > 0 && (
        <div style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', marginBottom: 5 }}>
          <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 3, fontSize: 7 }}>⛔ Противопоказания:</div>
          {catalogEntry.contraindications.map((c, ci) => (
            <div key={ci} style={{ fontSize: 7, color: '#fca5a5', marginBottom: 1 }}>• {c}</div>
          ))}
        </div>
      )}

      {/* Побочные эффекты */}
      {catalogEntry?.sideEffects && catalogEntry.sideEffects.length > 0 && (
        <div style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)', marginBottom: 5 }}>
          <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 3, fontSize: 7 }}>⚠ Побочные эффекты:</div>
          {catalogEntry.sideEffects.map((se, si) => (
            <div key={si} style={{ fontSize: 7, color: 'var(--text-light)', marginBottom: 1 }}>• {se}</div>
          ))}
        </div>
      )}

      {/* Взаимодействия из каталога */}
      {catalogEntry?.conflicts && catalogEntry.conflicts.length > 0 && (
        <div style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.1)' }}>
          <div style={{ fontWeight: 700, color: '#a855f7', marginBottom: 3, fontSize: 7 }}>❌ Конфликты:</div>
          {catalogEntry.conflicts.map((c, ci) => (
            <div key={ci} style={{ fontSize: 7, color: 'var(--text-light)', marginBottom: 1 }}>• <b>{c.with}</b> — {c.effect}</div>
          ))}
        </div>
      )}
    </div>
  );
};

// Описание синергии всего стека
export function buildStackSynergyDescription(rec: SupportRecommendation): string[] {
  const lines: string[] = [];
  const subIds = rec.subs.map(s => s.substanceId);

  // Системы-доминанты
  const systems: Record<string, number> = {};
  for (const s of rec.subs) {
    const cat = s.category;
    systems[cat] = (systems[cat] || 0) + 1;
  }
  const domSystems = Object.entries(systems).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // D3+K2
  if (subIds.some(s => s.toLowerCase().includes('vitamin_d3')) && subIds.some(s => s.toLowerCase().includes('vitamin_k2'))) {
    lines.push('💡 D3+K2 — кальциевый треугольник: D3 ↑ всасывание кальция, K2 направляет его в кости (а не в сосуды).');
  }
  // NAC+TUDCA
  if (subIds.some(s => s.toLowerCase() === 'nac') && subIds.some(s => s.toLowerCase() === 'tudca')) {
    lines.push('💡 NAC+TUDCA — двойная гепатопротекция: NAC → субстрат глутатиона (фаза II), TUDCA ↓ ER-стресс и желчеотток.');
  }
  // Serra+Natto+Bromelain
  const hasFibrinolytic = ['serrapeptase', 'nattokinase', 'bromelain'].filter(f => subIds.some(s => s.toLowerCase() === f));
  if (hasFibrinolytic.length >= 2) {
    lines.push(`💡 ${hasFibrinolytic.map(f => f === 'serrapeptase' ? 'Serra' : f === 'nattokinase' ? 'Natto' : 'Bromelain').join('+')} — 3 разных пути фибринолиза: ↓ воспаление, ↓ вязкость крови.`);
  }
  // Berberine+ALA
  if (subIds.some(s => s.toLowerCase() === 'berberine') && subIds.some(s => s.toLowerCase().includes('alpha_lipoic'))) {
    lines.push('💡 Berberine+α-Lipoic — двойной AMPK: ↓ глюкоза, ↑ инсулин-чувствительность (GH/инсулин-курсы).');
  }
  // Telmisartan+Tadalafil
  if (subIds.some(s => s.toLowerCase() === 'telmisartan') && subIds.some(s => s.toLowerCase() === 'tadalafil')) {
    lines.push('💡 Telmisartan+Tadalafil — ARB + PDE5i: ↓ АД (двойной путь), ↑ NO, защита эндотелия.');
  }
  // Curcumin+Piperine
  if (subIds.some(s => s.toLowerCase() === 'curcumin') && subIds.some(s => s.toLowerCase() === 'piperine')) {
    lines.push('💡 Curcumin+Piperine — пиперин ↑ биодоступность куркумина на 2000% (CYP3A4 ингибирование).');
  }
  // Astragalus+Cordyceps
  if (subIds.some(s => s.toLowerCase() === 'astragalus') && subIds.some(s => s.toLowerCase() === 'cordyceps')) {
    lines.push('💡 Astragalus+Cordyceps — нефропротекция: астрагал защищает клубочки, кордицепс ↓ BUN/креатинин.');
  }
  // Mg+D3
  if (subIds.some(s => s.toLowerCase() === 'magnesium') && subIds.some(s => s.toLowerCase().includes('vitamin_d3'))) {
    lines.push('💡 Mg+D3 — магний кофактор для метаболизма витамина D (25-OH → 1,25-OH); без Mg D3 слабо работает.');
  }
  // TMG+B-Complex
  if (subIds.some(s => s.toLowerCase() === 'tmg') && subIds.some(s => s.toLowerCase().includes('b_complex'))) {
    lines.push('💡 TMG+B-Complex — метилирование: TMG = донатор CH₃, B6+B12+Folate = cofactors для регенерации цикла.');
  }
  // VitC+VitE
  if (subIds.some(s => s.toLowerCase().includes('vitamin_c')) && subIds.some(s => s.toLowerCase().includes('vitamin_e'))) {
    lines.push('💡 VitC+VitE — антиоксидантная сеть: VitC регенерирует окисленный VitE → ↑ длительность защиты мембран.');
  }
  // Omega3+CoQ10
  if (subIds.some(s => s.toLowerCase() === 'omega3') && subIds.some(s => s.toLowerCase() === 'coq10')) {
    lines.push('💡 Omega3+CoQ10 — кардиопротекция: EPA/DHA мембраны + CoQ10 митохондрии миокарда.');
  }

  if (lines.length === 0 && subs_count(subIds) >= 8) {
    lines.push('📌 Базовый мульти-протокол: печень + сердце + почки + антиоксиданты. См. подробные причины в каждой карточке.');
  }

  return lines;
}

function subs_count(arr: string[]): number { return arr.length; }