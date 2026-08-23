// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import handler from '../../../api/ocr-image';

function invoke(req: any) {
  const state: { status: number; body: unknown } = { status: 200, body: undefined };
  const response = {
    status(code: number) { state.status = code; return response; },
    json(body: unknown) { state.body = body; return response; },
  };
  return handler(req, response as any).then(() => state);
}

describe('api/ocr-image', () => {
  it('rejects non-POST requests', async () => {
    const result = await invoke({ method: 'GET', body: {} });
    expect(result.status).toBe(405);
    expect(result.body).toMatchObject({ ok: false });
  });

  it('requires image data', async () => {
    const result = await invoke({ method: 'POST', body: {} });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ ok: false, error: 'Image data is required' });
  });

  it('rejects malformed base64 before starting OCR', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await invoke({ method: 'POST', body: { data: 'not base64!' } });
      expect(result.status).toBe(422);
      expect(result.body).toMatchObject({ ok: false, error: 'Image data must be valid base64' });
    } finally { errorSpy.mockRestore(); }
  });
});
