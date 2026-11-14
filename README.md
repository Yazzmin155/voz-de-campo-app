# Voz de Campo · Captura Agronómica Offline, Escudo Legal y Pasaporte QR

**Voz de Campo** es una aplicación web progresiva (**PWA offline-first**) diseñada específicamente para el **Técnico de Campo / Ingeniero Agrónomo de Enlace** que opera en zonas rurales sin cobertura celular.

Resuelve la *ceguera operativa de última milla* de las plataformas corporativas y agroexportadoras:

> **La IA interpreta y explica (`IBM Granite`). El motor normativo determinista decide (`SENASICA / CONAGUA`). El hash `SHA-256` certifica el lote.**

---

## Flujo de Demostración en 2 Minutos

1. **Ingreso en 1 toque:** Abre `/entrar` y pulsa **Probar Demo Completa (1 toque)** o ingresa con el PIN `2468`.
2. **Detección de Riesgo Fitosanitario (`LOTE-4B`):** En el Inicio verás la alerta crítica activa por aplicación de *Abamectina 1.8 CE* con cosecha programada a 6 días (cuando la regla `R-PHI-04` exige 14 días).
3. **Copiloto de Campo (`IBM Granite`):** Abre **Copiloto IA** en la cabecera y consulta *“¿Puedo cosechar hoy este lote?”*. El asistente explica el bloqueo citando la regla y ofrece un botón de acción directa.
4. **Dictado en Surco Sin Señal:** Toca el botón central **Dictar** en el dock inferior, usa el micrófono o carga cualquiera de los 3 casos de prueba con 1 toque, y pulsa **Interpretar con IBM Granite**.
5. **Escudo Legal y Pasaporte QR (`SHA-256`):** Ajusta los días para cosecha a `15` días con un toque, emite el **Pasaporte QR** y prueba el botón **Simular alteración de 1 dato** para comprobar cómo el hash `SHA-256` detecta cualquier intento de fraude.
6. **Sincronización Atómica hacia `IBM watsonx.data`:** Toca el chip **Sin señal** en la cabecera, inspecciona el contrato JSON y ejecuta la sincronización atómica.

---

## Arquitectura del Repositorio

```txt
voz-de-campo-app/
├─ api/
│  └─ ai/
│     ├─ chat.js                  # Proxy Serverless en Vercel hacia IBM watsonx.ai (Granite)
│     └─ health.js                # Diagnóstico del conector sin exponer llaves en el cliente
├─ public/
│  ├─ brand/                      # Logotipo oficial e identidad visual
│  ├─ icons/                      # Iconos PWA (192, 512, maskable, apple-touch-icon)
│  ├─ media/                      # Fotografías reales de lotes y avatares en WebP
│  └─ og/                         # Imagen Open Graph para compartir
├─ src/
│  ├─ app/App.tsx                 # Enrutador principal y guardia de sesión
│  ├─ components/
│  │  ├─ brand/BrandWordmark.tsx  # Marca tipográfica animada + logo oficial
│  │  ├─ field/                   # Copiloto IBM Granite y Centro de Sincronización
│  │  └─ layout/AppShell.tsx      # Dock móvil de 5 posiciones + Rail de escritorio
│  ├─ data/
│  │  ├─ rules.ts                 # Catálogo normativo SENASICA / COFEPRIS / CONAGUA
│  │  └─ seed.ts                  # Productores, parcelas, bitácoras y pasaportes iniciales
│  ├─ features/
│  │  ├─ auth/LoginPage.tsx
│  │  ├─ dashboard/DashboardPage.tsx
│  │  ├─ parcels/                 # Lista filtrable y expediente con croquis SVG offline
│  │  ├─ visits/NewVisitPage.tsx  # Captura por voz + Extractor Granite + Escudo Legal
│  │  ├─ passports/               # Certificados QR SHA-256 y Verificador Público
│  │  └─ settings/SettingsPage.tsx# Telemetría watsonx, Modo Sol y Reset de Demo
│  ├─ lib/                        # Dexie IndexedDB, SHA-256 Web Crypto, Parser y Reglas
│  ├─ styles/globals.css
│  └─ types/domain.ts
├─ tests/core.test.ts             # Pruebas unitarias (Vitest)
├─ docs/                          # Guías de IBM Cloud, Despliegue y Generación de APK
└─ vercel.json
```

---

## Comandos Locales

```bash
npm install
npm run dev        # Servidor de desarrollo local
npm run typecheck  # Verificación estricta de TypeScript
npm test           # Pruebas unitarias de Parser, Escudo Legal y SHA-256
npm run build      # Compilación de producción + Service Worker PWA
```
