module.exports = (request, response) => {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  let validHttpsUrl = false;
  try {
    validHttpsUrl = new URL(url).protocol === 'https:';
  } catch {}

  if (!validHttpsUrl || !publishableKey || !publishableKey.startsWith('sb_publishable_')) {
    response.status(503).json({ error: 'Supabase ainda não está configurado neste site.' });
    return;
  }

  response.status(200).json({ url, publishableKey });
};
