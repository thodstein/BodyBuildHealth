import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { username } = req.body || {};
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ ok: false, error: 'Username required' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ ok: false, error: 'Bot token not configured' });
  }

  const clean = username.trim().replace(/^@/, '');
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=@${clean}`);
    const data = await resp.json();
    if (data.ok && data.result) {
      return res.json({
        ok: true,
        id: data.result.id,
        name: data.result.first_name || data.result.title || clean,
        username: data.result.username || clean,
      });
    }
    return res.json({ ok: false, error: 'Пользователь не найден. Убедитесь, что username правильный и бот был добавлен в контакты.' });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message || 'Ошибка запроса' });
  }
}
