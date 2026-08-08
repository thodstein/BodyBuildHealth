import React from 'react';
import { SleepDiary } from './diaries/SleepDiary/SleepDiary';
import { BPDiary } from './diaries/BPDiary/BPDiary';
import { WeightDiary } from './diaries/WeightDiary/WeightDiary';
import { InjectionDiary } from './diaries/InjectionDiary/InjectionDiary';
import { HealthDiary } from './diaries/HealthDiary/HealthDiary';
import type { DiaryKey, DiaryGoals } from './diary-helpers';

export interface DiaryWindowProps { open: boolean; onClose: () => void; diaryKey: DiaryKey | 'measurements'; goals: DiaryGoals; onDataChange?: () => void; }
export const DiaryWindow: React.FC<DiaryWindowProps> = (p) => {
  if (p.diaryKey === 'sleep') return <SleepDiary {...p} />;
  if (p.diaryKey === 'bp') return <BPDiary {...p} />;
  if (p.diaryKey === 'weight' || p.diaryKey === 'measurements') return <WeightDiary {...p} />;
  if (p.diaryKey === 'injection') return <InjectionDiary {...p} />;
  return <HealthDiary {...p} />;
};
