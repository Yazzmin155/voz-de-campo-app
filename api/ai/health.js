export default async function handler(req, res) {
  const configured = Boolean(
    process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID
  );
  const region = process.env.WATSONX_REGION || 'us-south';
  const modelId = process.env.WATSONX_MODEL_ID || 'ibm/granite-4-h-small';
  const sttConfigured = Boolean(
    process.env.WATSON_STT_API_KEY && process.env.WATSON_STT_SERVICE_URL
  );

  return res.status(200).json({
    ok: true,
    configured,
    sttConfigured,
    provider: configured ? 'ibm-watsonx-live' : 'local-demo-engine',
    region,
    modelId,
    checkedAt: new Date().toISOString()
  });
}
