// ════════════════════════════════════════════════════════════════════════════
//  CalcSubstanceDetail — раскрываемая карточка препарата со всеми деталями
// ════════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import type { SupportRecommendation } from '../../../engines/tz-mapper-engine';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-catalog-data';
import { registerCatalogExtras } from '../../../data/support-catalog-extras';
registerCatalogExtras(SUPPORT_CATALOG_DATA);
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
  const [expanded, setExpanded] = useState(false);

  const id = sub.substanceId;
  const name = subNameRu(id);
  const dose = subDosage(id);
  const titrFactor = titrationFactors?.get(canonIdLocal(id));
  const isTitrated = !!titrFactor && titrFactor > 1;
  const form = getSubstanceForm(id);
  const titr = getTitrationProtocol(id);
  const catalogEntry = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toLowerCase()] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
  const tier = subTier(id);
  const mechsCovered = Array.isArray(sub.mechsCovered) ? sub.mechsCovered : [];
  const pharmacyBrands = Array.isArray(form?.pharmacyBrands) ? form.pharmacyBrands : [];
  const titrSteps = Array.isArray(titr?.steps) ? titr.steps : [];
  const monitorLabs = Array.isArray(titr?.monitorLabs) ? titr.monitorLabs : [];
  const stopConditions = Array.isArray(titr?.stopConditions) ? titr.stopConditions : [];
  const monitoring = Array.isArray(catalogEntry?.monitoring) ? catalogEntry.monitoring : [];
  const contraindications = Array.isArray(catalogEntry?.contraindications) ? catalogEntry.contraindications : [];
  const sideEffects = Array.isArray(catalogEntry?.sideEffects) ? catalogEntry.sideEffects : [];
  const conflicts = Array.isArray(catalogEntry?.conflicts) ? catalogEntry.conflicts : [];

  const doseMg = dose ? (titrFactor && titrFactor > 1 ? Math.round(dose.mg * titrFactor) : dose.mg) : null;

  return (
    <div className="calc-substdetail" style={{ ...GLASS, padding: 0, marginBottom: 3, fontSize: 8, lineHeight: 1.5, borderLeft: '2px solid rgba(99,102,241,0.3)', overflow: 'hidden' }}>

      {/* Заголовок: кликабельный — разворачивает/сворачивает карточку */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '10px 12px', cursor: 'pointer', flexWrap: 'wrap' }}
      >
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
        <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>док. {sub.q}</span>
        <span style={{ marginLeft: 'auto', fontSize: 8, color: 'var(--text-dim)', fontWeight: 600 }}>
          {expanded ? '▲ скрыть' : '▼ детали'}
        </span>
      </div>

      {/* Детали — только при раскрытии */}
      {expanded && (
        <div style={{ padding: '0 12px 10px' }}>

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
          {mechsCovered.length > 0 && (
            <div style={{ marginBottom: 5, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <span style={{ fontSize: 7, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.3px', width: '100%' }}>ТЗ-механизмы:</span>
              {mechsCovered.map(m => (
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
              {pharmacyBrands.length > 0 && (
                <div style={{ marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, color: '#00e68a', fontSize: 7 }}>Аптечные: </span>
                  <span style={{ color: 'var(--text-light)', fontSize: 8 }}>{pharmacyBrands.join(', ')}</span>
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
              {titrSteps.map((step, si) => (
                <div key={si} style={{ fontSize: 7, color: 'var(--text-light)', marginBottom: 2 }}>
                  <b style={{ color: '#fbbf24' }}>{step.dose}</b> ({step.duration})
                  {step.trigger ? ' — ' + step.trigger : ''}
                  {step.labTarget ? ` [цель: ${step.labTarget}]` : ''}
                </div>
              ))}
              {titr.flushWarning && (
                <div style={{ fontSize: 7, color: '#fbbf24', marginTop: 3, fontWeight: 600 }}>⚠ {titr.flushWarning}</div>
              )}
              {monitorLabs.length > 0 && (
                <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 3 }}>
                  🧪 Контроль: {monitorLabs.join(', ')} — {titr.frequency}
                </div>
              )}
              {stopConditions.length > 0 && (
                <div style={{ fontSize: 7, color: '#ef4444', marginTop: 2 }}>
                  ⛔ Стоп: {stopConditions.join('; ')}
                </div>
              )}
            </div>
          )}

          {/* Мониторинг из каталога */}
          {monitoring.length > 0 && (
            <div style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)', marginBottom: 5 }}>
              <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: 3, fontSize: 7 }}>🧪 Мониторинг анализов:</div>
              {monitoring.map((m, mi) => {
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
          {contraindications.length > 0 && (
            <div style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', marginBottom: 5 }}>
              <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 3, fontSize: 7 }}>⛔ Противопоказания:</div>
              {contraindications.map((c, ci) => (
                <div key={ci} style={{ fontSize: 7, color: '#fca5a5', marginBottom: 1 }}>• {c}</div>
              ))}
            </div>
          )}

          {/* Побочные эффекты */}
          {sideEffects.length > 0 && (
            <div style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)', marginBottom: 5 }}>
              <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 3, fontSize: 7 }}>⚠ Побочные эффекты:</div>
              {sideEffects.map((se, si) => (
                <div key={si} style={{ fontSize: 7, color: 'var(--text-light)', marginBottom: 1 }}>• {se}</div>
              ))}
            </div>
          )}

          {/* Взаимодействия из каталога */}
          {conflicts.length > 0 && (
            <div style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.1)' }}>
              <div style={{ fontWeight: 700, color: '#a855f7', marginBottom: 3, fontSize: 7 }}>❌ Конфликты:</div>
              {conflicts.map((c, ci) => (
                <div key={ci} style={{ fontSize: 7, color: 'var(--text-light)', marginBottom: 1 }}>• <b>{c.with}</b> — {c.effect}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Описание синергии всего стека
export function buildStackSynergyDescription(rec: SupportRecommendation): string[] {
  const lines: string[] = [];
  const subIds = rec.subs.map(s => s.substanceId.toLowerCase());
  const has = (id: string) => subIds.some(s => s === id || s.includes(id));

  // 1. D3+K2 — кальциевый треугольник
  if (has('vitamin_d3') && has('vitamin_k2')) {
    lines.push('💡 D3 + K2 — кальциевый гомеостаз: D3 ↑ всасывание Ca²⁺ в кишечнике (транспортный белок TRPV6), K2 (MK-7) активирует остеокальцин и MGP → направляет Ca²⁺ в кости и выводит из сосудов. Без K2 → кальцификация артерий.');
  }
  // 2. D3+K2+Mg — полное трио
  if (has('vitamin_d3') && has('vitamin_k2') && has('magnesium')) {
    lines.push('💡 D3 + K2 + Mg — полный кальциевый треугольник: Mg — кофактор 1α-гидроксилазы (25-OH-D → 1,25-OH-D). Без Mg D3 конвертируется слабо, без K2 Ca²⁺ депонируется в сосудах.');
  }
  // 3. NAC+TUDCA — двойная гепатопротекция
  if (has('nac') && has('tudca')) {
    lines.push('💡 NAC + TUDCA — двойная гепатопротекция через разные пути: NAC → субстрат для синтеза глутатиона (GSH, фаза II детокс), TUDCA → ↓ ER-стресс (ингибиция CHOP/GADD153), ↑ BSEP-зависимый желчеотток. NAC = цитопротекция, TUDCA = анти-холестаз.');
  }
  // 4. NAC+Glycine — глутатион через два субстрата
  if (has('nac') && has('glycine')) {
    lines.push('💡 NAC + Glycine — два лимитирующих субстрата для GSH (γ-Glu-Cys-Gly): NAC = Cys, Glycine = Gly. Вместе ↑ внутриклеточный глутатион на 30-40% (vs NAC один ~15%).');
  }
  // 5. Serra+Natto+Bromelain — фибринолиз 3 путями
  const fibrinolytic = ['serrapeptase', 'nattokinase', 'bromelain'].filter(f => has(f));
  if (fibrinolytic.length >= 2) {
    const names = fibrinolytic.map(f => f === 'serrapeptase' ? 'Serra' : f === 'nattokinase' ? 'Natto' : 'Bromelain').join('+');
    lines.push(`💡 ${names} — 3 независимых пути фибринолиза: Serra расщепляет α₂-макроглобулин (ингибитор плазмина), Natto активирует плазминоген → плазмин напрямую, Bromelain ↓ PAI-1. Полный охват каскада.`);
  }
  // 6. Berberine+ALA — двойной AMPK
  if (has('berberine') && has('alpha_lipoic')) {
    lines.push('💡 Berberine + α-Lipoic — двойная активация AMPK: Berberine ↑ AMPK через LKB1 (↓ глюконеогенез), ALA ↑ AMPK через CaMKKβ (↑ захват глюкозы). Вместе ↓ HbA1c на 0.5-1.0%, ↑ инсулин-чувствительность (критично для GH/инсулин курсов).');
  }
  // 7. Telmisartan+Tadalafil — эндотелиальная защита
  if (has('telmisartan') && has('tadalafil')) {
    lines.push('💡 Telmisartan + Tadalafil — ARB + PDE5i: Telmisartan ↓ АТII → вазодилатация + ↓ гипертрофия сосудистой стенки, Tadalafil ↑ цГМФ → NO-зависимая вазодилатация. Двойной путь ↓ АД + защита эндотелия.');
  }
  // 8. Curcumin+Piperine — биодоступность
  if (has('curcumin') && has('piperine')) {
    lines.push('💡 Curcumin + Piperine — пиперин ингибирует CYP3A4 и UGT в кишечнике → ↑ биодоступность куркумина на 2000%. Без пиперина куркумин почти не всасывается (<1%).');
  }
  // 9. Astragalus+Cordyceps — нефропротекция
  if (has('astragalus') && has('cordyceps')) {
    lines.push('💡 Astragalus + Cordyceps — два механизма нефропротекции: Astragalus ↓ протеинурию (стабилизация подоцитов, ↓ TGF-β), Cordyceps ↓ BUN и сывороточный креатинин (↑ клубочковая фильтрация). Вместе — защита почек на ААС-курсах.');
  }
  // 10. Mg+D3 — кофактор
  if (has('magnesium') && has('vitamin_d3') && !has('vitamin_k2')) {
    lines.push('💡 Mg + D3 — магний кофактор 1α-гидроксилазы (25-OH-D → 1,25-OH-D в почках). Без Mg D3 конвертируется только на 40-60%. Mg бисглицинат — оптимальный для сна, треонат — для ЦНС.');
  }
  // 11. TMG+B-Complex — метилирование
  if (has('tmg') && has('b_complex')) {
    lines.push('💡 TMG + B-Complex — полная поддержка метилирования: TMG = донатор CH₃ (β-ин амин), B6 (P5P) кофактор для SHMT, B12 (метил) кофактор для MS (гомоцистеин → метионин), Folate (5-MTHF) донатор CH₃ в цикле. ↓ гомоцистеин.');
  }
  // 12. VitC+VitE — антиоксидантная сеть
  if (has('vitamin_c') && has('vitamin_e')) {
    lines.push('💡 Vit C + Vit E — антиоксидантная сеть: Vit C регенерирует окисленный токоферол (Vit E) обратно в активную форму за счёт своего восстановительного потенциала. ↑ длительность защиты мембран от перекисного окисления.');
  }
  // 13. Omega3+CoQ10 — кардиопротекция
  if (has('omega3') && has('coq10')) {
    lines.push('💡 Omega-3 + CoQ10 — двойная кардиопротекция: EPA/DHA встраиваются в мембраны кардиомиоцитов (↓ аритмии, ↓ TG), CoQ10 — электрон-транспорт в митохондриях миокарда (↑ АТФ, ↓ оксидативный стресс.');
  }
  // 14. Iron+VitC — всасывание железа
  if (has('iron') && has('vitamin_c')) {
    lines.push('💡 Iron + Vit C — Vit C восстанавливает Fe³⁺ → Fe²⁺ (единственная всасываемая форма) в просвете кишечника, ↑ всасывание железа на 2-6x. Рекомендуется Iron бисглицинат (не сульфат) + Vit C 200 мг. ');
  }
  // 15. TUDCA+Milk Thistle — гепатопротекция (different mechanisms)
  if (has('tudca') && has('milk_thistle')) {
    lines.push('💡 TUDCA + Силимарин — комплементарная гепатопротекция: TUDCA ↓ ER-стресс + улучшаетжелчеотток, силимарин стабилизирует мембраны гепатоцитов + ↑ РНК-полимеразу I. TUDCA = внутри клетки, силимарин = мембрана.');
  }
  // 16. Saw Palmetto+Tadalafil — BPH/простата
  if (has('saw_palmetto') && has('tadalafil')) {
    lines.push('💡 Saw Palmetto + Tadalafil — двойная защита простаты: Saw Palmetto ингибирует 5α-редуктазу (↓ DHT → ↓ гиперплазия), Tadalafil ↓ симптомы LUTS через расслабление гладкой мускулатуры простаты. ');
  }
  // 17. Selenium+Iodine — щитовидная железа
  if (has('selenium') && has('iodine')) {
    lines.push('💡 Selenium + Iodine — два кофактора для синтеза T3/T4: I = субстрат (тиреоидные гормоны), Se (селенопероксидаза) = конвертирует T4 → T3, защищает тироциты от окисления H₂O₂. Без Se I может повреждать щитовидную.');
  }
  // 18. Bergamot+CoQ10 — липиды+митохондрии
  if (has('bergamot') && has('coq10')) {
    lines.push('💡 Bergamot + CoQ10 — Bergamot содержит бергамотины ↓ MG-CoA редуктазу (статиноподобно, ↓ LDL 15-25%), CoQ10 восполняется (статиноподобные ↓ CoQ10). Защита липидов + митохондрий.');
  }
  // 19. Niacin+Garlic — липидная коррекция
  if (has('niacin') && has('garlic')) {
    lines.push('💡 Ниацин + Чеснок — Ниацин ↑ HDL на 15-35% (↑ ApoA-I), чеснок ↓ LDL и TG (inhibit squalene synthase). Вместе: HDL↑ + LDL↓ + TG↓ (без статинов). ');
  }
  // 20. Niacin+Omega3 — комбинированная липидная коррекция
  if (has('niacin') && has('omega3')) {
    lines.push('💡 Ниацин + Омега-3 — комбинированная липидная коррекция: Ниацин ↑ HDL и ↓ TG (inhibit липолиз в адипоцитах), Омега-3 ↓ TG и ↓ VLDL (↓ секреция апоB). Синергия по TG.');
  }
  // 21. Ashwagandha+Rhodiola — двойной адаптоген
  if (has('ashwagandha') && has('rhodiola')) {
    lines.push('💡 Ashwagandha + Rhodiola — двойная адаптогенная защита: Ashwagandha ↓ кортизол через HPA-ось (↑ ГАМК), Rhodiola ↑ дофамин/серотонин через ↓ МАО-А. Вместе: ↓ стресс + ↑ мотивация (без седации).');
  }
  // 22. Zinc+Boron — тестостерон (↓SHBG + ↑T)
  if (has('zinc') && has('boron')) {
    lines.push('💡 Zinc + Boron — синергия тестостерона: Zn — кофактор 17β-HSD и CYP11A1 (синтез T), Boron ↓ SHBG на 15-30% → ↑ свободный тестостерон. Вместе: ↑ продукция + ↑ биодоступность T.');
  }
  // 23. Citicoline+Phosphatidylserine — когниция
  if (has('citicoline') && has('phosphatidylserine')) {
    lines.push('💡 Citicoline + Phosphatidylserine — нейропротекция: Citicoline ↑ ацетилхолин (память, фокус) и фосфатидилхолин (мембраны), PS ↓ кортизол в гиппокампе (↑ BDNF, ↑ синаптическая пластичность). Двойная защита ЦНС.');
  }
  // 24. Glucosamine+Chondroitin — хрящ
  if (has('glucosamine') && has('chondroitin')) {
    lines.push('💡 Glucosamine + Chondroitin — синергия хряща: Glucosamine = субстрат для синтеза ГАГ (↑ протеогликаны матрикса), Chondroitin ↓ MMP-13 (↓ деградацию коллагена II типа). Синтез + анаболизм хряща.');
  }
  // 25. Citrulline+Arginine — NO-каскад
  if (has('citrulline') && has('arginine')) {
    lines.push('💡 Citrulline + Arginine — двойной субстрат NO-каскада: Citrulline конвертируется в аргинин через ASS/ASL (почки), дополняя прямой приём аргинина. ↑ аргинин в плазме на 30% больше, чем при одном аргинине. ↑ NO → вазодилатация.');
  }
  // 26. Melatonin+Glycine — сон
  if (has('melatonin') && has('glycine')) {
    lines.push('💡 Melatonin + Glycine — двойной сон: Melatonin активирует MT1/MT2 (циркадный ритм), Glycine — тормозной GlyR (↓ температура тела, ↑ дельта-сон). Вместе: засыпание + глубокий сон.');
  }
  // 27. Probiotics+L-Glutamine — ЖКТ
  if (has('probiotics') && (has('l_glutamine') || has('glutamine'))) {
    lines.push('💡 Probiotics + L-Glutamine — восстановление ЖКТ: Probiotics ↑ sIgA и Treg (иммунитет слизистой), L-Glutamine — топливо для энтероцитов (↑ ZO-1, ↑ барьер). Вместе: микробиом + барьер кишечника.');
  }
  // 28. Berberine+Chromium — глюкоза (AMPK + IR-β)
  if (has('berberine') && has('chromium')) {
    lines.push('💡 Berberine + Chromium — двойной контроль глюкозы: Berberine ↑ AMPK (↓ глюконеогенез), Chromium ↑ тирозинкиназу IR-β (↑ чувствительность к инсулину). Вместе: ↓ продукция + ↑ утилизация глюкозы.');
  }
  // 29. Taurine+Magnesium — электролиты/сон
  if (has('taurine') && has('magnesium')) {
    lines.push('💡 Taurine + Magnesium — синергия электролитов и сна: Taurine — осмолит (регуляция Ca²⁺ в миоцитах), Mg — блокатор Ca-каналов L-типа. Вместе: ↓ АД, стабилизация ритма сердца,↑ качество сна через ГАМК-ергический механизм.');
  }
  // 30. Collagen+Vitamin C — синтез коллагена
  if (has('collagen') && has('vitamin_c')) {
    lines.push('💡 Collagen + Vitamin C — синергия синтеза коллагена: Collagen = субстрат (глицин, пролин, гидроксипролин), Vit C = кофактор пролилгидроксилазы (гидроксилирование Pro/Lys → тройная спираль). Без Vit C коллаген нестабилен.');
  }

  if (lines.length === 0 && subIds.length >= 8) {
    lines.push('📌 Базовый мульти-протокол: печень + сердце + почки + антиоксиданты. Подробности в каждой карточке.');
  }

  return lines;
}
