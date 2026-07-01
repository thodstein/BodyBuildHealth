// ── Types for support-db ──
export interface TzSupportEntry {
  organId: string;
  mechId: string;
  k: number;
  q: 'A' | 'B' | 'C';
  source: string;
}
