import { LabPoint, CourseEntry } from '../core/types';
import { UCUM_MAP } from '../core/constants';
import { PHARMA_LAB_MARKERS } from '../data/pharma-lab-marker-map';
import { PHARMA_DB, PHARMA_CLASSES } from '../core/pharma-database';

export interface LabDrugAlert {
  marker: string;
  value: number;
  unit: string;
  expectedRange: [number, number];
  actualStatus: 'high' | 'low' | 'normal';
  drugCause: string[];
  severity: 'low' | 'med' | 'high' | 'critical';
  recommendation: string;
}

/**
 * Ж4 (фаза 2 женского слоя): женские верхние границы для lab-pharma корреляций.
 * Числа — из женского лаб-слоя (FEMALE_LAB_GROUPS таба «Женщины и ААС») без новых
 * клинических порогов: HCT 48 (флеботомия >52), HGB 150, RBC 5.2,
 * TT 173 нг/дл ≈ 6 нмоль/л (порог вирилизации), PRL 25 нг/мл (женский верх),
 * E2 400 пг/мл (фолликулярный верх; лютеиновая до 500 — оговорка в тексте).
 */
const FEMALE_LAB_ULN: Record<string, number> = {
  HCT: 48,
  HGB: 150,
  RBC: 5.2,
  TT: 173,
  PRL: 25,
  E2: 400,
};

function getDrugClassName(id: string): string {
  const p = PHARMA_DB[id] as any;
  if (!p?.class) return 'unknown';
  return p.class;
}

// Infer effect direction from drug class + known pharmacology
function getDrugMarkerEffect(drugId: string, marker: string): { effect: 'up' | 'down'; severity: number } {
  const p = PHARMA_DB[drugId] as any;
  if (!p) return { effect: 'up', severity: 0.5 };
  const cls = p.class || '';

  // AAS generally increase HCT, HGB, RBC, ALT, AST, LDL
  if (['testosterone','nandrolone','trenbolone','dht','boldenone','oral_17aa','sarm'].includes(cls)) {
    if (['HCT','HGB','RBC'].includes(marker)) return { effect: 'up', severity: 0.7 };
    if (['ALT','AST','GGT'].includes(marker)) return { effect: 'up', severity: cls === 'oral_17aa' ? 0.9 : 0.5 };
    if (['LDL','CHOL'].includes(marker)) return { effect: 'up', severity: 0.6 };
    if (['HDL'].includes(marker)) return { effect: 'down', severity: 0.8 };
    if (['LH','FSH','SHBG'].includes(marker)) return { effect: 'down', severity: 0.9 };
    if (['E2'].includes(marker)) return { effect: 'up', severity: cls === 'testosterone' ? 0.7 : 0.3 };
    if (['PRL'].includes(marker)) return { effect: 'up', severity: cls === 'trenbolone' ? 0.7 : 0.4 };
    if (['TT','FT'].includes(marker)) return { effect: 'up', severity: 1.0 };
    if (['DHT'].includes(marker)) return { effect: 'up', severity: cls === 'dht' ? 0.9 : 0.4 };
    if (['CREATININE','UREA'].includes(marker)) return { effect: 'up', severity: 0.3 };
    if (['BP_SYSTOLIC','BP_DIASTOLIC'].includes(marker)) return { effect: 'up', severity: 0.4 };
    if (['PSA'].includes(marker)) return { effect: 'up', severity: 0.5 };
    return { effect: 'up', severity: 0.4 };
  }

  // Aromatase inhibitors
  if (cls === 'ai' || cls === 'inhibitor_aromatase') {
    if (['E2'].includes(marker)) return { effect: 'down', severity: 0.95 };
    if (['TT','FT'].includes(marker)) return { effect: 'up', severity: 0.3 };
    return { effect: 'down', severity: 0.3 };
  }

  // SERM
  if (cls === 'serm' || cls === 'antiestrogen') {
    if (['LH','FSH'].includes(marker)) return { effect: 'up', severity: 0.9 };
    if (['TT','FT'].includes(marker)) return { effect: 'up', severity: 0.8 };
    if (['SHBG'].includes(marker)) return { effect: 'up', severity: 0.5 };
    return { effect: 'up', severity: 0.4 };
  }

  // Dopamine agonists
  if (cls === 'dopamine_agonist' || drugId === 'caberg') {
    if (['PRL'].includes(marker)) return { effect: 'down', severity: 0.98 };
    return { effect: 'down', severity: 0.3 };
  }

  // ARBs / BP drugs
  if (['arb','ace_inhibitor'].includes(cls)) {
    if (['BP_SYSTOLIC','BP_DIASTOLIC'].includes(marker)) return { effect: 'down', severity: 0.8 };
    if (['K'].includes(marker)) return { effect: 'up', severity: 0.5 };
    return { effect: 'down', severity: 0.4 };
  }

  // Beta blockers
  if (cls === 'beta_blocker') {
    if (['BP_SYSTOLIC','BP_DIASTOLIC','HR'].includes(marker)) return { effect: 'down', severity: 0.7 };
    if (['HDL'].includes(marker)) return { effect: 'down', severity: 0.2 };
    return { effect: 'down', severity: 0.3 };
  }

  // Statins
  if (cls === 'statin') {
    if (['LDL','CHOL'].includes(marker)) return { effect: 'down', severity: 0.9 };
    if (['HDL'].includes(marker)) return { effect: 'up', severity: 0.2 };
    if (['ALT','AST'].includes(marker)) return { effect: 'up', severity: 0.3 };
    return { effect: 'down', severity: 0.3 };
  }

  // NSAIDs
  if (cls === 'nsaid') {
    if (['CREATININE','UREA'].includes(marker)) return { effect: 'up', severity: 0.4 };
    if (['BP_SYSTOLIC'].includes(marker)) return { effect: 'up', severity: 0.3 };
    return { effect: 'up', severity: 0.2 };
  }

  // Antioxidants / hepatoprotectors
  if (['antioxidant','hepatoprotector'].includes(cls)) {
    if (['ALT','AST','GGT'].includes(marker)) return { effect: 'down', severity: 0.5 };
    return { effect: 'down', severity: 0.3 };
  }

  return { effect: 'up', severity: 0.5 };
}

export function analyzeLabDrugCorrelation(
  labs: LabPoint[],
  course: CourseEntry[],
  currentPhase: string,
  sex?: 'male' | 'female'
): LabDrugAlert[] {
  const alerts: LabDrugAlert[] = [];
  // Только активные по фазе: on_cycle — в курсе, pct — недавно оконченные, иначе все
  const activeDrugs = course.filter(c => {
    if (currentPhase === 'on_cycle') return c.endWeek >= 0 && c.startWeek <= 52;
    if (currentPhase === 'pct') return c.endWeek >= -4;
    return c.endWeek >= 0;
  });

  Object.entries(UCUM_MAP).forEach(([marker, meta]) => {
    const markerLabs = labs.filter(l => l.code.toUpperCase() === marker).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (!markerLabs.length) return;

    const latest = markerLabs[0].value;
    // На курсе — сужаем верхнюю границу для HCT/ALT/E2, в ПКТ — нижнюю для LH/TT
    const isOnCycleCrit = currentPhase === 'on_cycle' && ['HCT','HGB','RBC','ALT','AST','E2','LDL','CHOL'].includes(marker);
    const isPctCrit = currentPhase === 'pct' && ['LH','FSH','TT','FT','SHBG'].includes(marker);
    // Ж4: женские верхние границы (без sex — прежняя мужская шкала байт-в-байт).
    const femaleUln = sex === 'female' ? FEMALE_LAB_ULN[marker] : undefined;
    const uln = (femaleUln ?? meta.uln) * (isOnCycleCrit ? 0.95 : 1);
    const lln = meta.lln * (isPctCrit ? 1.05 : 1);

    const impactingDrugs: string[] = [];
    let maxSeverity = 0;
    const effects: string[] = [];

    activeDrugs.forEach(d => {
      // Только явная связь из PHARMA_LAB_MARKERS — иначе засоряется причинность (любой ААС → любой маркер)
      const markerList = PHARMA_LAB_MARKERS[d.substanceId];
      if (markerList && markerList.includes(marker)) {
        impactingDrugs.push(d.substanceId);
        const ef = getDrugMarkerEffect(d.substanceId, marker);
        maxSeverity = Math.max(maxSeverity, ef.severity);
        effects.push(`${d.substanceId}:${ef.effect}`);
      }
    });

    const isHigh = latest > uln;
    const isLow = latest < lln;
    const status = isHigh ? 'high' : isLow ? 'low' : 'normal';

    if (status !== 'normal') {
      let rec = 'Мониторинг и контроль динамики.';
      if (marker === 'HCT' && isHigh) rec = 'Гидратация + контроль АД. При >54% – рассмотреть эксфузию. Контроль ферритина и донации.';
      if (marker === 'ALT' && isHigh && effects.some(e => e.includes(':up'))) rec = 'Повышение АЛТ на фоне ААС/оральных. Добавить NAC 1200–1800 мг/сут + TUDCA 500 мг/сут.';
      if (marker === 'GGT' && isHigh) rec = 'Маркер холестаза. Добавить TUDCA 500 мг/сут + артишок. Рассмотреть УДХК.';
      if (marker === 'LDL' && isHigh) rec = 'Гиперлипидемия. Добавить Омега-3 3–4 г/сут + бергамот 1000 мг + красный рис.';
      if (marker === 'HDL' && isLow) rec = 'Снижение ЛПВП на курсе. Добавить Омега-3, коэнзим Q10, аэробные нагрузки.';
      if (marker === 'E2' && isHigh) rec = 'Гиперэстрогения. Рассмотреть ИА (анастрозол 0.5–1 мг/нед) или ИИ (летрозол 2.5 мг/нед) по E2.';
      if (marker === 'PRL' && isHigh) rec = 'Гиперпролактинемия (характерно для тренболона/нандролона). Добавить каберголин 0.25–0.5 мг/нед.';
      if (marker === 'BP_SYSTOLIC' && isHigh) rec = 'Повышение АД. Телмисартан 40–80 мг/сут + небиволол 2.5–5 мг/сут при ЧСС >75.';
      if (marker === 'CREATININE' && isHigh) rec = 'Нагрузка на почки. Контроль гидратации, добавить астрагал 500 мг/сут + сельдерей.';
      if (marker === 'LH' && isLow) rec = 'Подавление ГГЯ-оси ожидаемо на курсе ААС. Контроль после отмены.';
      if (marker === 'TT' && isHigh) rec = 'Супрафизиологический тестостерон. Контроль E2, HCT, PSA.';
      if (marker === 'HGB' && isHigh) rec = 'Полицитемия. Гидратация, донация при >18.5 г/дл.';

      // Drug-specific recommendations
      if (impactingDrugs.some(id => id.includes('anastro'))) {
        if (marker === 'LH' && isLow) rec = 'Анастрозол подавляет ароматазу — контроль E2 для предотвращения rebound.';
      }
      if (impactingDrugs.some(id => id.includes('caberg'))) {
        if (marker === 'PRL' && isLow) rec = 'Каберголин может чрезмерно снизить пролактин. Рассмотреть снижение дозы.';
      }

      // Ж4 (фаза 2): женские тексты — порог/тактика отличаются (только sex=female).
      if (sex === 'female') {
        if (marker === 'HCT' && isHigh) rec = '♀ Гидратация + контроль АД. Флеботомия у женщин — при HCT >52% (муж 54%). Контроль ферритина и донации.';
        if (marker === 'TT' && isHigh) rec = '♀ Тестостерон выше женского порога (~6 нмоль/л) — ВИРИЛИЗАЦИЯ: отмена/эскалация, контроль голоса/клитора, к гинекологу-эндокринологу.';
        if (marker === 'PRL' && isHigh) rec = '♀ Гиперпролактинемия (женский верх ~25 нг/мл). Каберголин — только по назначению врача; контроль менструального цикла.';
        if (marker === 'E2' && isHigh) rec = '♀ Эстрадиол выше женского коридора — интерпретация ТОЛЬКО по фазе цикла (фолликулярная 40–200, лютеиновая 70–500 пг/мл): без фазы оценка условна.';
        if (marker === 'E2' && isLow) rec = '♀ Дефицит E2 = риск остеопороза и нарушения цикла; интерпретация по фазе цикла, к гинекологу-эндокринологу.';
      }

      alerts.push({
        marker,
        value: latest,
        unit: meta.prefUnit,
        expectedRange: [lln, uln],
        actualStatus: status,
        drugCause: impactingDrugs.length > 0 ? impactingDrugs : ['неизвестный препарат'],
        severity: maxSeverity > 0.85 ? 'critical' : maxSeverity > 0.65 ? 'high' : maxSeverity > 0.45 ? 'med' : 'low',
        recommendation: rec
      });
    }
  });

  return alerts.sort((a, b) => {
    const o = { critical: 0, high: 1, med: 2, low: 3 };
    return (o[a.severity] || 4) - (o[b.severity] || 4);
  });
}
