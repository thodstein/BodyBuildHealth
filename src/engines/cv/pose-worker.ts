/**
 * pose-worker.ts — WebWorker для BlazePose (MediaPipe Tasks Vision).
 *
 * Грузит WASM с CDN, держит PoseLandmarker в воркере, чтобы не морозить UI
 * в Telegram WebView на слабых телефонах. Общается с главным потоком via postMessage.
 *
 * Протокол:
 *  main -> worker: { type:'init' }
 *  worker -> main: { type:'ready' } | { type:'error', message }
 *  main -> worker: { type:'detect', id, imageData: ImageData, width, height, timestamp }
 *  worker -> main: { type:'result', id, landmarks, error? }
 */
let landmarker: any = null;
let initializing: Promise<any> | null = null;

async function ensureLandmarker(): Promise<any> {
  if (landmarker) return landmarker;
  if (initializing) return initializing;
  initializing = (async () => {
    try {
      const vision: any = await import('@mediapipe/tasks-vision');
      const { PoseLandmarker, FilesetResolver } = vision;
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      return landmarker;
    } catch (e: any) {
      throw new Error(e?.message || String(e));
    }
  })();
  return initializing;
}

self.onmessage = async (e: MessageEvent) => {
  const data = e.data as any;
  if (data?.type === 'init') {
    try {
      await ensureLandmarker();
      (self as any).postMessage({ type: 'ready' });
    } catch (err: any) {
      (self as any).postMessage({ type: 'error', message: err?.message || String(err) });
    }
    return;
  }
  if (data?.type === 'detect') {
    const { id, imageData, timestamp } = data;
    try {
      const lm = await ensureLandmarker();
      if (!lm) throw new Error('landmarker not ready');
      // Tasks Vision can accept ImageData via detectForVideo with canvas-like
      // Fallback: create ImageData-like
      const result = lm.detectForVideo(imageData, timestamp);
      const landmarks = result?.landmarks?.[0] ?? null;
      (self as any).postMessage({ type: 'result', id, landmarks });
    } catch (err: any) {
      (self as any).postMessage({ type: 'result', id, landmarks: null, error: err?.message || String(err) });
    }
  }
};
