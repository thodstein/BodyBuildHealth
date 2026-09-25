import { MUSCLE_LABEL_RU } from '../volume-landmarks.engine';

export interface CanonicalBBValidationIssue {
  code?: string;
  level?: 'error' | 'warning' | 'info' | string;
  message?: string;
  text?: string;
  week?: number;
  session?: number;
  exercise?: string | number;
  muscle?: string;
}

const MUSCLE_KEYS = 'chest|back|quads|hamstrings|glutes|calves|biceps|triceps|forearms|abs|traps|shoulders|delt_front|delt_mid|delt_rear|lower_back';

export function canonicalBBIssueText(issue: CanonicalBBValidationIssue): string {
  return String(issue.message || issue.text || '')
    .replace(new RegExp(`\\b(${MUSCLE_KEYS})\\b`, 'g'), muscle => MUSCLE_LABEL_RU[muscle] || muscle)
    .trim();
}
