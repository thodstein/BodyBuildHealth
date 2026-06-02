export const getRiskColor = (value: number): string => {
  if (value < 20) return '#22c55e';
  if (value < 40) return '#84cc16';
  if (value < 60) return '#eab308';
  if (value < 80) return '#f97316';
  return '#ef4444';
};