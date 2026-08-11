import type { DiaryKey, DiaryGoals } from './diary-helpers';

export interface DiaryWindowProps {
  open: boolean;
  onClose: () => void;
  diaryKey: DiaryKey | 'measurements';
  goals: DiaryGoals;
  onDataChange?: () => void;
  onNavigate?: (screen: string) => void;
}
