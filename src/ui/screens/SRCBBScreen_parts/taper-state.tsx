/**
 * taper-state.tsx — 🏁 ТАПЕР-STATE ПЛ-авто (Этап 3 разгрузки SRCBBScreen).
 *
 * Весь state соревнований/тапера (сезон, параметры, прикиды, mock/meet/пост,
 * тапер-план) вынесен из SRCBBScreen в хук usePLTaperState + React-контекст:
 *  - SRCBBScreen (обёртка) предоставляет состояние через PLTaperProvider;
 *  - внутренний компонент и PLCompetitionTab читают его через usePLTaper()
 *    без пропс-дриллинга.
 * Сериализация he_pl_session остаётся в SRCBBScreen (единый источник записи).
 */
import React, { createContext, useContext, useState } from 'react';
import type { MeetStrategy } from '../../../engines/lms/competition-attempts';
import type { PeakWeekLayout, TaperMode, TaperWeightGoal } from '../../../engines/lms/lms-taper.engine';
import type { LMSBuildOutput } from '../../../engines/lms/lms-builder.engine';
import type { PLMeetListItem } from './PLCompetitionTab';

export interface PLTaperState {
  bw: number; setBw: React.Dispatch<React.SetStateAction<number>>;
  targetBw: number; setTargetBw: React.Dispatch<React.SetStateAction<number>>;
  weeksToMeet: number; setWeeksToMeet: React.Dispatch<React.SetStateAction<number>>;
  taperWeeksToAdd: number; setTaperWeeksToAdd: React.Dispatch<React.SetStateAction<number>>;
  attemptStrategy: MeetStrategy; setAttemptStrategy: React.Dispatch<React.SetStateAction<MeetStrategy>>;
  peakMode: TaperMode; setPeakMode: React.Dispatch<React.SetStateAction<TaperMode>>;
  peakLayout: PeakWeekLayout; setPeakLayout: React.Dispatch<React.SetStateAction<PeakWeekLayout>>;
  taperWeightGoal: TaperWeightGoal; setTaperWeightGoal: React.Dispatch<React.SetStateAction<TaperWeightGoal>>;
  taperFed: string; setTaperFed: React.Dispatch<React.SetStateAction<string>>;
  taperActualPm: Record<string, number>;
  setTaperActualPm: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  taperPlannedPm: Record<string, number>;
  setTaperPlannedPm: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  taperAttemptOverride: Record<string, number[]>;
  setTaperAttemptOverride: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;
  mockMeetOn: boolean; setMockMeetOn: React.Dispatch<React.SetStateAction<boolean>>;
  meetWeekOn: boolean; setMeetWeekOn: React.Dispatch<React.SetStateAction<boolean>>;
  postMeetOn: boolean; setPostMeetOn: React.Dispatch<React.SetStateAction<boolean>>;
  taperNote: string; setTaperNote: React.Dispatch<React.SetStateAction<string>>;
  taperPlan: LMSBuildOutput | null; setTaperPlan: React.Dispatch<React.SetStateAction<LMSBuildOutput | null>>;
  meetList: PLMeetListItem[];
  setMeetList: React.Dispatch<React.SetStateAction<PLMeetListItem[]>>;
  mainMeetId: string; setMainMeetId: React.Dispatch<React.SetStateAction<string>>;
  /** Синхронизация: локальные поля = главное соревнование. */
  applyMainMeet: (m: PLMeetListItem) => void;
  updateMainMeet: (patch: Partial<PLMeetListItem>) => void;
  addMeet: () => void;
  removeMeet: (id: string) => void;
}

/** Состояние тапера + логика сезона (инициализация из сохранённой сессии). */
export function usePLTaperState(saved: any, profBodyWeight?: number): PLTaperState {
  const [bw, setBw] = useState<number>(saved?.plBw ?? profBodyWeight ?? 85);
  const [targetBw, setTargetBw] = useState<number>(saved?.plTargetBw ?? bw);
  const [weeksToMeet, setWeeksToMeet] = useState<number>(saved?.plWeeksToMeet ?? 8);
  const [taperWeeksToAdd, setTaperWeeksToAdd] = useState<number>(saved?.plTaperWeeksToAdd ?? 2);
  const [taperNote, setTaperNote] = useState<string>(saved?.plTaperNote ?? '');
  const [attemptStrategy, setAttemptStrategy] = useState<MeetStrategy>(saved?.plAttemptStrategy ?? 'balanced');
  const [mockMeetOn, setMockMeetOn] = useState<boolean>(saved?.plMockMeet ?? false);
  const [meetWeekOn, setMeetWeekOn] = useState<boolean>(saved?.plMeetWeek ?? true);
  const [taperActualPm, setTaperActualPm] = useState<Record<string, number>>(saved?.plTaperActualPm ?? { 'Присед': 0, 'Жим лежа': 0, 'Становая тяга': 0 });
  const [taperPlannedPm, setTaperPlannedPm] = useState<Record<string, number>>(saved?.plTaperPlannedPm ?? { 'Присед': 0, 'Жим лежа': 0, 'Становая тяга': 0 });
  const [taperFed, setTaperFed] = useState<string>(saved?.plTaperFed ?? 'fpr');
  const [taperAttemptOverride, setTaperAttemptOverride] = useState<Record<string, number[]>>({});
  const [meetList, setMeetList] = useState<PLMeetListItem[]>(() => {
    const savedList = saved?.plMeetList as PLMeetListItem[] | undefined;
    if (Array.isArray(savedList) && savedList.length > 0) return savedList;
    return [{ id: 'm1', name: 'Соревнование 1', weeksToStart: weeksToMeet, fed: taperFed, plannedPm: { ...taperPlannedPm }, strategy: attemptStrategy }];
  });
  const [mainMeetId, setMainMeetId] = useState<string>((saved?.plMainMeetId as string) ?? 'm1');
  const [peakMode, setPeakMode] = useState<TaperMode>(saved?.plPeakMode ?? 'pl');
  const [taperWeightGoal, setTaperWeightGoal] = useState<TaperWeightGoal>(saved?.plTaperWeightGoal ?? 'auto');
  const [peakLayout, setPeakLayout] = useState<PeakWeekLayout>(saved?.plPeakLayout ?? 'attempts');
  const [postMeetOn, setPostMeetOn] = useState<boolean>(saved?.plPostMeetOn ?? true);
  const [taperPlan, setTaperPlan] = useState<LMSBuildOutput | null>(null);

  const applyMainMeet = (m: PLMeetListItem) => {
    setWeeksToMeet(m.weeksToStart);
    setTaperFed(m.fed);
    setTaperPlannedPm({ ...m.plannedPm });
    setAttemptStrategy(m.strategy);
  };
  const updateMainMeet = (patch: Partial<PLMeetListItem>) => {
    setMeetList(cur => cur.map(m => m.id === mainMeetId ? { ...m, ...patch } : m));
  };
  const addMeet = () => {
    const last = meetList[meetList.length - 1];
    const id = 'm' + Date.now();
    const item: PLMeetListItem = {
      id,
      name: `Соревнование ${meetList.length + 1}`,
      weeksToStart: (last?.weeksToStart ?? 8) + 6,
      fed: last?.fed ?? 'fpr',
      plannedPm: { ...(last?.plannedPm ?? {}) },
      strategy: last?.strategy ?? 'balanced',
    };
    setMeetList(cur => [...cur, item]);
  };
  const removeMeet = (id: string) => {
    setMeetList(cur => cur.length <= 1 ? cur : cur.filter(m => m.id !== id));
    if (id === mainMeetId) {
      const next = meetList.find(m => m.id !== id);
      if (next) { setMainMeetId(next.id); applyMainMeet(next); }
    }
  };

  return {
    bw, setBw, targetBw, setTargetBw, weeksToMeet, setWeeksToMeet,
    taperWeeksToAdd, setTaperWeeksToAdd, attemptStrategy, setAttemptStrategy,
    peakMode, setPeakMode, peakLayout, setPeakLayout, taperWeightGoal, setTaperWeightGoal,
    taperFed, setTaperFed, taperActualPm, setTaperActualPm, taperPlannedPm, setTaperPlannedPm,
    taperAttemptOverride, setTaperAttemptOverride,
    mockMeetOn, setMockMeetOn, meetWeekOn, setMeetWeekOn, postMeetOn, setPostMeetOn,
    taperNote, setTaperNote, taperPlan, setTaperPlan,
    meetList, setMeetList, mainMeetId, setMainMeetId,
    applyMainMeet, updateMainMeet, addMeet, removeMeet,
  };
}

const PLTaperContext = createContext<PLTaperState | null>(null);

/** Читает тапер-state из контекста (fallback — изолированный дефолт для тестов/превью). */
export function usePLTaper(): PLTaperState {
  const ctx = useContext(PLTaperContext);
  if (ctx) return ctx;
  return usePLTaperState(null);
}

/** Провайдер тапер-state для SRCBBScreen и его вкладок. */
export const PLTaperProvider: React.FC<{ saved: any; profBodyWeight?: number; children: React.ReactNode }> = ({ saved, profBodyWeight, children }) => {
  const tp = usePLTaperState(saved, profBodyWeight);
  return <PLTaperContext.Provider value={tp}>{children}</PLTaperContext.Provider>;
};
