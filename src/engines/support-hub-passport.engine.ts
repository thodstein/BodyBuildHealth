/**
 * support-hub-passport.engine.ts — P7: паспорт вещества.
 * Собирает в одну структуру то, что уже есть в хабе (био/доза/UL/тайминг/
 * синергия/аналоги/лабы/грейд). Новых чисел не выдумывает: чего нет — hasData:false.
 */
import { bioEvidenceFor, doseWindowFor, evidenceGradeExFor, personDoseHints, type PersonCtx } from './support-hub-evidence.engine';
import { timingHintsFor } from './support-hub-timing.engine';

export interface SubstancePassport {
  id: string;
  nameRu: string;
  grade: string;
  gradeLabel: string;
  bio: { max: number; label: string; evidence: string; marketing: boolean } | null;
  dose: { min: number; opt: number; max: number; ul: number; unit: string; note: string; hasData: boolean };
  personHints: string[];
  timing: string[];
  synergyTop: string[];
  conflictTop: string[];
  labs: string[];
  analogHint: string;
}

export function buildSubstancePassport(args: {
  id: string;
  nameRu: string;
  maxBio: number;
  formKey?: string;
  therapeutic: Record<string, { minMg: number; optMg: number; maxMg: number; ul: number; note: string; unit?: string }>;
  ranges: Record<string, { therMin: number; therMax: number; label: string }>;
  category: string[];
  synergies?: Array<{ with?: string; effect?: string }>;
  conflicts?: Array<{ with?: string; effect?: string }>;
  labMarkers?: Array<{ marker: string; target: string }>;
  person?: PersonCtx;
  /** Резолв id → человеческое имя (без него в строках светятся сырые id). */
  resolveName?: (id: string) => string;
}): SubstancePassport {
  const ev = bioEvidenceFor(args.formKey || 'standard', args.maxBio);
  const dose = doseWindowFor(args.id, args.therapeutic, args.ranges);
  const grade = evidenceGradeExFor(args.id);
  const gradeLabel = grade === 'A' ? 'A — высокий' : grade === 'B' ? 'B — умеренный' : grade === 'C' ? 'C — низкий' : 'D — данных почти нет';
  const nameOf = (id: string | undefined): string => {
    const raw = (id || '').trim();
    if (!raw) return '';
    if (args.resolveName) {
      try {
        const resolved = args.resolveName(raw);
        if (resolved && resolved !== raw) return resolved;
      } catch { /* fallback ниже */ }
    }
    return raw;
  };
  return {
    id: args.id,
    nameRu: args.nameRu,
    grade,
    gradeLabel,
    bio: {
      max: args.maxBio,
      label: `${Math.round(ev.lo * 100)}–${Math.round(ev.hi * 100)}%`,
      evidence: ev.source === 'meta' ? 'мета-анализ' : ev.source === 'RCT' ? 'РКИ' : ev.source === 'review' ? 'обзор' : 'заявление производителя',
      marketing: ev.marketing,
    },
    dose,
    personHints: personDoseHints(args.id, args.person || {}),
    timing: timingHintsFor(args.nameRu, args.category).map(r => `${r.label}: ${r.detail}`),
    synergyTop: (args.synergies || []).slice(0, 3).map(s => `${nameOf(s.with)} — ${s.effect || ''}`.trim()),
    conflictTop: (args.conflicts || []).slice(0, 3).map(s => `${nameOf(s.with)} — ${s.effect || ''}`.trim()),
    labs: (args.labMarkers || []).slice(0, 4).map(l => `${l.marker} → ${l.target}`),
    analogHint: 'Аналог подбирается в табе «Аналоги» по механизму + классу + грейду (профиль — из Профиля, не 30/80/180 по умолчанию).',
  };
}
