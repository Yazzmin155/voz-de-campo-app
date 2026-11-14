// Vercel Serverless Function: Proxy opcional hacia IBM Watson Speech to Text (Plan Lite 500 min/mes)
// Si las variables WATSON_STT_API_KEY y WATSON_STT_SERVICE_URL no están configuradas,
// devuelve un estado controlado para que el cliente use Web Speech / transcripción local sin errores.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.WATSON_STT_API_KEY;
  const serviceUrl = process.env.WATSON_STT_SERVICE_URL;

  if (!apiKey || !serviceUrl) {
    return res.status(200).json({
      ok: true,
      configured: false,
      provider: 'browser-fallback',
      transcript: null,
      message:
        'Watson Speech to Text no configurado en variables de entorno. Usando motor de voz del navegador + edición asistida.'
    });
  }

  try {
    const { audioBase64, contentType = 'audio/webm' } = req.body || {};
    if (!audioBase64) {
      return res.status(400).json({ ok: false, error: 'Missing audioBase64 payload' });
    }

    const buffer = Buffer.from(audioBase64, 'base64');
    const endpoint = `${serviceUrl.replace(/\/$/, '')}/v1/recognize?model=es-MX_BroadbandModel`;
    const auth = Buffer.from(`apikey:${apiKey}`).toString('base64');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': contentType,
        Accept: 'application/json'
      },
      body: buffer
    });

    if (!response.ok) {
      return res.status(200).json({
        ok: false,
        configured: true,
        provider: 'watson-stt-error',
        transcript: null
      });
    }

    const data = await response.json();
    const transcript = (data.results || [])
      .map((r) => r.alternatives?.[0]?.transcript || '')
      .join(' ')
      .trim();

    return res.status(200).json({
      ok: true,
      configured: true,
      provider: 'ibm-watson-stt',
      transcript
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      configured: true,
      provider: 'watson-stt-exception',
      transcript: null,
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}
