/**
 * NutritionProCards.tsx — единый набор PRO-карточек питания (периодизация, рефиды/диет-брейки,
 * недельный разбор, схема добавок) для таба «Отчёт» (те же данные, что в табе «План»).
 * Читает `usePlanCtx`, строит те же входы (база/график/дневник/стек поддержки).
 */
import React from 'react';
import { usePlanCtx } from './IndividualPlanContext';
import { NutritionPeriodizationCard } from './NutritionPeriodizationCard';
import { RefeedCalendarCard } from './RefeedCalendarCard';
import { WeeklyReviewCard } from './WeeklyReviewCard';
import { SupplementTimingCard } from './SupplementTimingCard';
import { buildTrainSchedule, isTrainingDayFor } from './planner-training-schedule';
import { localIsoDate } from './planner-date-utils';
import { getWeightLog } from '../../../../engines/profile-store';
import { readDiaryV2 } from '../diary-storage-v2';

const diaryEntriesForDate = (date: string): any[] => {
  try {
    const diary = readDiaryV2();
    if (Array.isArray(diary)) return diary.filter((d: any) => (d.date || d.createdAt || '').startsWith(date));
    const meals = diary?.[date]?.meals || {};
    return Object.values(meals).flatMap((meal: any) => Array.isArray(meal) ? meal : []);
  } catch { return []; }
};

const scheduledSpecialMeals = (): { date: string; type: 'refeed' | 'cheat_meal' | 'fast' | 'diet_break' }[] => {
  try {
    const raw = JSON.parse(localStorage.getItem('he_special_meals') || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((m: any) => m && typeof m.date === 'string' && ['refeed', 'cheat_meal', 'fast', 'diet_break'].includes(m.type))
      .map((m: any) => ({ date: m.date, type: m.type as 'refeed' | 'cheat_meal' | 'fast' | 'diet_break' }));
  } catch { return []; }
};

export const NutritionProCards: React.FC = () => {
  const {
    generated, dayPlan, effectiveKcal, effectiveP, effectiveF, effectiveC, waterCalc,
    goal, carbPeriodization, bbPrepPlan, bodyFatPct,
    linkToTraining, trainStart, trainEnd, trainingDays, trainScheduleType, trainPattern, heavyTrainDay, DAY_LABELS,
    takenSupplements, supportStackSupplements, sex, weight, selectedDayIndex, applyKcalAdjust, planTargets,
  } = usePlanCtx();

  const weightLog = (() => { try { return getWeightLog().map(e => ({ date: e.date, weightKg: e.weight })); } catch { return []; } })();
  const trainStartMin = (() => { const mm = /^(\d{1,2}):(\d{2})$/.exec(String(trainStart || '')); return mm ? Number(mm[1]) * 60 + Number(mm[2]) : undefined; })();
  const trainDurationMin = (() => {
    const a = /^(\d{1,2}):(\d{2})$/.exec(String(trainStart || ''));
    const b = /^(\d{1,2}):(\d{2})$/.exec(String(trainEnd || ''));
    if (!a || !b) return undefined;
    const d = (Number(b[1]) * 60 + Number(b[2])) - (Number(a[1]) * 60 + Number(a[2]));
    return d > 0 ? d : undefined;
  })();
  const isTrain = isTrainingDayFor(buildTrainSchedule(linkToTraining, trainStart, trainEnd, trainingDays, trainScheduleType, trainPattern), selectedDayIndex);

  const weeklyDays = (() => {
    const out: { date: string; kcal: number; proteinG: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const date = localIsoDate(d);
      const entries = diaryEntriesForDate(date);
      const kcal = Math.round(entries.reduce((s: number, x: any) => s + (x.kcal || 0), 0));
      const p = Math.round(entries.reduce((s: number, x: any) => s + (x.p || x.protein || 0), 0));
      if (kcal > 0) out.push({ date, kcal, proteinG: p });
    }
    return out;
  })();

  return (
    <div data-pro-cards="1">
      {generated && effectiveKcal > 0 && (
        <div style={{ marginBottom: 8 }}>
          <NutritionPeriodizationCard
            prepPlan={bbPrepPlan}
            base={{ kcal: effectiveKcal, proteinG: effectiveP, fatG: effectiveF, carbsG: effectiveC, waterMl: waterCalc?.total ? Math.round(waterCalc.total * 1000) : 3000, sodiumMg: waterCalc?.electrolytes?.sodiumMg || 3500 }}
            goal={goal}
            carbPeriodization={carbPeriodization}
            isTrainingDayForOffset={(offset) => isTrainingDayFor(buildTrainSchedule(linkToTraining, trainStart, trainEnd, trainingDays, trainScheduleType, trainPattern), offset)}
            heavyTrainDay={heavyTrainDay}
            dayLabels={DAY_LABELS}
            todayIso={localIsoDate(new Date())}
            maintenanceKcal={(planTargets as any)?.tdee || undefined}
            specialMeals={scheduledSpecialMeals()}
            weightLog={weightLog}
          />
        </div>
      )}
      <RefeedCalendarCard goal={goal} startDate={localIsoDate(new Date())} bodyFatPct={bodyFatPct} />
      {generated && dayPlan && weeklyDays.length > 0 && (
        <WeeklyReviewCard days={weeklyDays} targetKcal={dayPlan?.totals?.kcal || effectiveKcal || 0} targetProteinG={dayPlan?.totals?.p || effectiveP || 0} weightLog={weightLog} goal={goal} onApplyKcalAdjust={applyKcalAdjust} />
      )}
      {generated && dayPlan && (supportStackSupplements?.length || takenSupplements?.length || 0) > 0 && (
        <SupplementTimingCard
          supplements={(supportStackSupplements?.length ? supportStackSupplements : takenSupplements.map(id => ({ id })))}
          meals={(dayPlan.meals || []).map((m: any) => ({ type: String(m.type || ''), label: String(m.label || ''), time: String(m.time || ''), items: (m.items || []).map((it: any) => ({ id: it.id, name: it.name, f: it.f })) }))}
          trainStartMin={trainStartMin}
          trainDurationMin={trainDurationMin}
          isTrainingDay={isTrain}
          weightKg={weight || 80}
          sex={sex}
          goal={goal}
        />
      )}
    </div>
  );
};
