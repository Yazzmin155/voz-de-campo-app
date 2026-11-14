# Integración con IBM watsonx.ai y Gobernanza de Datos

## 1. Propuesta de Valor para el Ecosistema IBM

Las plataformas analíticas y de inteligencia artificial corporativa (**IBM watsonx.data**, **IBM watsonx.ai** y **watsonx.governance**) requieren datos estructurados, verificados y libres de ruido desde el origen. En la cadena agroalimentaria, ese origen está en parcelas sin cobertura celular.

**Voz de Campo** actúa como el nodo de **Edge Data Ingestion**:

1. **Captura estructurada asistida por `IBM Granite`:** Transforma notas de voz del ingeniero agrónomo en esquemas JSON estandarizados.
2. **Gobernanza Zero-PII antes de la nube:** Filtra datos personales sensibles (teléfono, firma, coordenadas exactas) en el dispositivo antes de consultar el modelo.
3. **Veredicto determinista auditable:** El modelo de lenguaje nunca decide por sí solo si un lote cumple la ley; la decisión recae en el motor determinista de reglas (`SENASICA / CONAGUA`) y se sella con `SHA-256`.

---

## 2. Cómo activar IBM Granite en Vivo (Plan Lite Gratuito)

La aplicación funciona de inmediato en **Modo Demo Local** sin llaves externas. Para conectarla en vivo a tu cuenta de IBM Cloud:

1. Ingresa a [IBM Cloud](https://cloud.ibm.com/) y crea un proyecto en **watsonx.ai** (región recomendada: `us-south` / Dallas).
2. Asocia una instancia de **watsonx.ai Runtime** en el plan gratuito **Lite** (hasta 300,000 tokens/mes sin costo).
3. Copia tu **API Key** (`Manage → Access (IAM) → API keys`) y el **Project ID** (`Proyecto → Manage → General`).
4. En tu proyecto de **Vercel** (o en un archivo `.env.local` que está ignorado por Git), define:

```env
WATSONX_API_KEY=tu_api_key_de_ibm_cloud
WATSONX_PROJECT_ID=tu_project_id_de_watsonx
WATSONX_REGION=us-south
WATSONX_MODEL_ID=ibm/granite-4-h-small
```

5. Abre la app en `Ajustes → Enlace Corporativo · IBM watsonx` y pulsa **Probar conexión `/api/ai/health`**.
