// Vercel Serverless Function: Proxy seguro hacia IBM watsonx.ai (Granite)
// Si las variables de entorno no están definidas, responde en modo demo determinista.

let cachedIamToken = null;
let cachedIamExpiry = 0;

async function getIamToken(apiKey) {
  const now = Date.now();
  if (cachedIamToken && cachedIamExpiry - 60000 > now) {
    return cachedIamToken;
  }

  const res = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: apiKey
    })
  });

  if (!res.ok) {
    throw new Error(`IAM auth error: ${res.status}`);
  }

  const data = await res.json();
  cachedIamToken = data.access_token;
  cachedIamExpiry = now + (data.expires_in || 3600) * 1000;
  return cachedIamToken;
}

function buildSystemPrompt(mode, context) {
  const ctxSummary = context
    ? `Contexto actual del lote:
- Lote: ${context.parcelCode || 'N/A'} (${context.parcelName || 'Sin nombre'})
- Cultivo: ${context.crop || 'No especificado'} (${context.areaHa || '?'} ha)
- Etapa: ${context.stage || 'En seguimiento'}
- Última aplicación: ${context.product || 'Ninguna'} (${context.dose || '?'} ${context.doseUnit || ''})
- Carencia requerida: ${context.phiDays ?? 'N/A'} días · Días transcurridos: ${context.daysElapsed ?? 'N/A'}
- Estado normativo: ${context.complianceStatus || 'En revisión'}
- Reglas activas: ${(context.rules || []).map((r) => `${r.code} (${r.severity}): ${r.title}`).join('; ') || 'Ninguna'}`
    : 'Sin lote seleccionado actualmente.';

  if (mode === 'extract') {
    return `Eres el motor de extracción agronómica de Voz de Campo (IBM Granite).
Extrae únicamente un objeto JSON válido a partir de la nota de voz del técnico.
No agregues markdown ni explicaciones fuera del JSON.
Esquema esperado:
{
  "activity": "aplicacion_fitosanitaria" | "riego" | "cosecha" | "monitoreo" | "fertilizacion",
  "crop": string,
  "product": string | null,
  "activeIngredient": string | null,
  "dose": number | null,
  "doseUnit": "L/ha" | "kg/ha" | "mL/ha" | "g/ha" | null,
  "areaHa": number | null,
  "waterVolumeM3": number | null,
  "plannedHarvestDays": number | null,
  "pestOrTarget": string | null,
  "summary": string
}`;
  }

  return `Eres el Copiloto de Campo de Voz de Campo, impulsado por IBM Granite en watsonx.ai.
Hablas español de México, con tono técnico, directo y breve (máximo 110 palabras).
Reglas estrictas:
1. Usa sólo el contexto proporcionado y las reglas fitosanitarias citadas.
2. Nunca apruebes ni certifiques un lote por cuenta propia; el veredicto legal lo emite el motor determinista de reglas.
3. Si falta un dato agronómico, indícalo con claridad.
4. Cita el código de la regla (por ejemplo, R-PHI-01 o R-BAN-02) cuando expliques una alerta.
5. No inventes dosis ni productos fuera del catálogo.

${ctxSummary}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startedAt = Date.now();
  const { mode = 'chat', prompt = '', context = null } = req.body || {};

  const apiKey = process.env.WATSONX_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;
  const region = process.env.WATSONX_REGION || 'us-south';
  const modelId = process.env.WATSONX_MODEL_ID || 'ibm/granite-4-h-small';

  if (!apiKey || !projectId) {
    return res.status(200).json({
      provider: 'demo-fallback',
      model: `${modelId} (demo local)`,
      configured: false,
      latencyMs: Date.now() - startedAt,
      requestId: `demo-${Date.now().toString(36)}`,
      message:
        'Variables WATSONX_API_KEY / WATSONX_PROJECT_ID no definidas en el servidor. Usando motor local determinista.'
    });
  }

  try {
    const token = await getIamToken(apiKey);
    const endpoint = `https://${region}.ml.cloud.ibm.com/ml/v1/text/chat?version=2025-02-06`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        model_id: modelId,
        project_id: projectId,
        messages: [
          { role: 'system', content: buildSystemPrompt(mode, context) },
          { role: 'user', content: String(prompt).slice(0, 3500) }
        ],
        parameters: {
          max_tokens: 420,
          temperature: mode === 'extract' ? 0.1 : 0.25
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(200).json({
        provider: 'demo-fallback',
        model: modelId,
        configured: true,
        error: `watsonx HTTP ${response.status}: ${errText.slice(0, 180)}`,
        latencyMs: Date.now() - startedAt,
        requestId: `wx-err-${Date.now().toString(36)}`
      });
    }

    const payload = await response.json();
    const content =
      payload?.choices?.[0]?.message?.content ||
      payload?.results?.[0]?.generated_text ||
      '';
    const usage = payload?.usage || {
      prompt_tokens: 180,
      completion_tokens: 95,
      total_tokens: 275
    };

    return res.status(200).json({
      provider: 'watsonx',
      model: payload?.model_id || modelId,
      configured: true,
      text: content.trim(),
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      },
      latencyMs: Date.now() - startedAt,
      requestId: payload?.id || `wx-${Date.now().toString(36)}`
    });
  } catch (error) {
    return res.status(200).json({
      provider: 'demo-fallback',
      model: modelId,
      configured: true,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startedAt,
      requestId: `wx-fallback-${Date.now().toString(36)}`
    });
  }
}
