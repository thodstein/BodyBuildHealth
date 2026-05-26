export function drawLineChart(canvas: HTMLCanvasElement, data: number[], ci95?: [number,number][], labels: string[] = [], title: string = '', color = '#2481cc') {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  const pad = 40;
  ctx.clearRect(0,0,w,h);
  
  // Фон
  ctx.fillStyle = '#2c2c2e'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle = '#8e8e93'; ctx.font = '12px sans-serif'; ctx.fillText(title, pad, 15);
  
  const maxVal = Math.max(...data, ...ci95?.flat() || [0]) * 1.1;
  const minVal = Math.min(0, ...data, ...ci95?.flat() || [0]);
  const range = maxVal - minVal || 1;
  const xStep = (w - pad*2) / (data.length - 1 || 1);
  
  // Сетка
  ctx.strokeStyle = '#3a3a3c'; ctx.lineWidth = 1;
  for(let i=0; i<=5; i++) {
    const y = h - pad - ((minVal + (range*i/5) - minVal)/range) * (h-pad*2);
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w-pad, y); ctx.stroke();
  }

  // CI95 band
  if(ci95) {
    ctx.fillStyle = color+'33';
    ctx.beginPath();
    for(let i=0; i<data.length; i++) {
      const x = pad + i*xStep;
      const yLow = h - pad - ((ci95[i][0]-minVal)/range)*(h-pad*2);
      ctx.lineTo(x, yLow);
    }
    for(let i=data.length-1; i>=0; i--) {
      const x = pad + i*xStep;
      const yHigh = h - pad - ((ci95[i][1]-minVal)/range)*(h-pad*2);
      ctx.lineTo(x, yHigh);
    }
    ctx.fill();
  }

  // Линия
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
  data.forEach((v,i) => {
    const x = pad + i*xStep;
    const y = h - pad - ((v-minVal)/range)*(h-pad*2);
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.stroke();

  // Точки & лейблы
  ctx.fillStyle = '#fff';
  data.forEach((v,i) => {
    const x = pad + i*xStep;
    const y = h - pad - ((v-minVal)/range)*(h-pad*2);
    ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
    if(labels[i]) {
      ctx.fillStyle = '#8e8e93'; ctx.font = '10px sans-serif';
      ctx.fillText(labels[i], x-8, h-10);
    }
  });
}