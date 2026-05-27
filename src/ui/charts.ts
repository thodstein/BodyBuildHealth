export function drawLineChart(
  canvas: HTMLCanvasElement,
  data: number[],
  ci95?: [number, number][],
  labels: string[] = [],
  title: string = '',
  color: string = '#2481cc',
  fillColor?: string
) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const pad = { top: 24, right: 16, bottom: 24, left: 32 };
  const drawW = w - pad.left - pad.right;
  const drawH = h - pad.top - pad.bottom;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#2c2c2e';
  ctx.fillRect(0, 0, w, h);

  if (title) {
    ctx.fillStyle = '#8e8e93';
    ctx.font = '11px sans-serif';
    ctx.fillText(title, pad.left, 14);
  }

  const maxVal = Math.max(...data, ...(ci95?.flat() || [0])) * 1.15;
  const minVal = Math.min(0, ...data, ...(ci95?.flat() || [0]));
  const range = maxVal - minVal || 1;
  const xStep = drawW / (data.length - 1 || 1);

  // Сетка
  ctx.strokeStyle = '#3a3a3c';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (drawH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
  }

  // CI95 band
  if (ci95 && ci95.length === data.length) {
    const bandColor = fillColor || color + '33';
    ctx.fillStyle = bandColor;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = pad.left + i * xStep;
      const yLow = pad.top + drawH - ((ci95[i][0] - minVal) / range) * drawH;
      ctx.lineTo(x, yLow);
    }
    for (let i = data.length - 1; i >= 0; i--) {
      const x = pad.left + i * xStep;
      const yHigh = pad.top + drawH - ((ci95[i][1] - minVal) / range) * drawH;
      ctx.lineTo(x, yHigh);
    }
    ctx.fill();
  }

  // Линия данных
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = pad.left + i * xStep;
    const y = pad.top + drawH - ((v - minVal) / range) * drawH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Точки & лейблы
  ctx.fillStyle = '#fff';
  data.forEach((v, i) => {
    const x = pad.left + i * xStep;
    const y = pad.top + drawH - ((v - minVal) / range) * drawH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    if (labels[i]) {
      ctx.fillStyle = '#8e8e93';
      ctx.font = '9px sans-serif';
      ctx.fillText(labels[i], x - 4, h - 8);
    }
  });
}