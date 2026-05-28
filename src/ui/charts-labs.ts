export function drawLabTrend(
  canvas: HTMLCanvasElement,
  data: { week: number; value: number; isAbnormal?: boolean }[],
  uln: number,
  lln: number,
  unit: string,
  markerName: string
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 140 * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = 140;
  const pad = { top: 25, right: 15, bottom: 25, left: 40 };
  const drawW = w - pad.left - pad.right;
  const drawH = h - pad.top - pad.bottom;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#2c2c2e';
  ctx.fillRect(0, 0, w, h);

  // Заголовок
  ctx.fillStyle = '#8e8e93';
  ctx.font = '11px sans-serif';
  ctx.fillText(`${markerName} (${unit})`, pad.left, 15);

  if (data.length < 2) {
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.fillText('Нужно минимум 2 записи', w/2 - 40, h/2);
    return;
  }

  // Масштаб
  const maxVal = Math.max(...data.map(d => d.value), uln) * 1.1;
  const minVal = Math.min(...data.map(d => d.value), lln) * 0.9;
  const range = maxVal - minVal || 1;

  // Сетка и реф. зона
  const yToPixel = (v: number) => pad.top + drawH - ((v - minVal) / range) * drawH;
  ctx.strokeStyle = '#3a3a3c';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (drawH / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
  }

  // Референсный коридор
  const yULN = yToPixel(uln), yLLN = yToPixel(lln);
  ctx.fillStyle = 'rgba(48, 209, 88, 0.08)';
  ctx.fillRect(pad.left, yULN, drawW, yLLN - yULN);
  ctx.strokeStyle = '#30d158';
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(pad.left, yULN); ctx.lineTo(w - pad.right, yULN); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pad.left, yLLN); ctx.lineTo(w - pad.right, yLLN); ctx.stroke();
  ctx.setLineDash([]);

  // Линия тренда
  ctx.strokeStyle = '#007aff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = pad.left + (i / (data.length - 1)) * drawW;
    const y = yToPixel(d.value);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Точки
  data.forEach((d, i) => {
    const x = pad.left + (i / (data.length - 1)) * drawW;
    const y = yToPixel(d.value);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = d.isAbnormal ? '#ff453a' : '#fff';
    ctx.fill();
    ctx.strokeStyle = '#007aff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#8e8e93';
    ctx.font = '9px sans-serif';
    ctx.fillText(`${d.value}`, x - 8, y - 8);
  });
}